import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from '../common/dto';

function durationSeconds(value: string | undefined, fallback: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value ?? fallback);
  if (!match || Number(match[1]) < 1) throw new Error('JWT expiry must use a positive number followed by s, m, h, or d.');
  const units: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(match[1]) * units[match[2]];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterDto) {
    const role = input.role ?? (input.businessName ? UserRole.VENDOR : UserRole.CUSTOMER);
    let vendor: { create: { businessName: string } } | undefined;
    if (role === UserRole.VENDOR) {
      const businessName = input.businessName?.trim();
      if (!businessName) throw new BadRequestException('A businessName is required to register as a vendor.');
      vendor = { create: { businessName } };
    }
    if (role === UserRole.CUSTOMER && input.businessName !== undefined) {
      throw new BadRequestException('businessName can only be provided when registering as a vendor.');
    }
    if (await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } })) {
      throw new ConflictException('An account with this email already exists.');
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash,
        role,
        ...(vendor ? { vendor } : {}),
      },
      select: { id: true, role: true, email: true },
    });
    return this.issueTokens(user.id, user.role, user.email);
  }

  async login(input: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return this.issueTokens(user.id, user.role, user.email);
  }

  async refresh(token: string) {
    let payload: { sub: string; type: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: this.refreshSecret() });
    } catch {
      throw new UnauthorizedException('The refresh token is invalid or expired.');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException('A refresh token is required.');

    const tokenHash = this.hash(token);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!stored || stored.expiresAt <= new Date() || stored.userId !== payload.sub) {
      throw new UnauthorizedException('The refresh token is invalid or expired.');
    }

    const consumed = await this.prisma.refreshToken.deleteMany({
      where: { id: stored.id, tokenHash, expiresAt: { gt: new Date() } },
    });
    if (consumed.count !== 1) throw new UnauthorizedException('The refresh token is invalid or expired.');
    return this.issueTokens(stored.user.id, stored.user.role, stored.user.email);
  }

  private async issueTokens(userId: string, role: UserRole, email: string) {
    const accessExpiresIn = durationSeconds(this.config.get<string>('JWT_ACCESS_EXPIRES_IN'), '15m');
    const refreshExpiresIn = durationSeconds(this.config.get<string>('JWT_REFRESH_EXPIRES_IN'), '7d');
    const accessToken = await this.jwt.signAsync({ sub: userId, role }, { expiresIn: accessExpiresIn });
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, type: 'refresh' },
      { secret: this.refreshSecret(), expiresIn: refreshExpiresIn },
    );
    await this.prisma.refreshToken.create({
      data: { tokenHash: this.hash(refreshToken), userId, expiresAt: new Date(Date.now() + refreshExpiresIn * 1000) },
    });
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessExpiresIn,
      user: { id: userId, role, email },
    };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshSecret(): string {
    const secret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is required. Copy .env.example to .env and set a secure secret.');
    }
    return secret;
  }
}
