import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { DeliveryStatus, OrderStatus, PaymentMethod, UserRole } from '@prisma/client';

@ValidatorConstraint({ name: 'isProductImageLocation', async: false })
class ProductImageLocationConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    if (value.startsWith('/uploads/')) {
      return /^\/uploads\/products\/[0-9a-f-]+\.(?:jpe?g|png|gif|webp)$/i.test(value);
    }
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'imageUrl must be an HTTP(S) URL or a URL returned by the product image upload endpoint.';
  }
}

export class RegisterDto {
  @ApiProperty({ format: 'email', example: 'customer@example.com' })
  @IsEmail() email!: string;
  @ApiProperty({ minLength: 8, example: 'strong-password' })
  @IsString() @MinLength(8) password!: string;
  @ApiProperty({ minLength: 1, example: 'Jane Customer' })
  @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional({
    enum: [UserRole.CUSTOMER, UserRole.VENDOR],
    example: UserRole.CUSTOMER,
    description: 'Public registration supports customer and vendor accounts. Admin accounts are provisioned separately.',
  })
  @IsOptional() @IsIn([UserRole.CUSTOMER, UserRole.VENDOR])
  role?: typeof UserRole.CUSTOMER | typeof UserRole.VENDOR;
  @ApiPropertyOptional({
    example: 'Fresh Foods',
    description: 'Required when role is VENDOR. Do not provide for CUSTOMER accounts.',
  })
  @IsOptional() @IsString() businessName?: string;
}

export class LoginDto {
  @ApiProperty({ format: 'email', example: 'customer@example.com' })
  @IsEmail() email!: string;
  @ApiProperty({ example: 'strong-password' })
  @IsString() password!: string;
}

export class RefreshDto {
  @ApiProperty({ example: 'refresh-token' })
  @IsString() refreshToken!: string;
}

export class CreateStoreDto {
  @ApiProperty({ minLength: 1, example: 'Downtown Market' })
  @IsString() @MinLength(1) name!: string;
  @ApiProperty({ minLength: 1, example: '123 Market Street' })
  @IsString() @MinLength(1) address!: string;
}

export class CreateCategoryDto {
  @ApiProperty({ minLength: 1, example: 'Fresh Produce' })
  @IsString() @MinLength(1) name!: string;
  @ApiProperty({ minLength: 1, example: 'fresh-produce' })
  @IsString() @MinLength(1) slug!: string;
}

export class CreateSubcategoryDto {
  @ApiProperty({ minLength: 1, example: 'Citrus Fruits' })
  @IsString() @MinLength(1) name!: string;
  @ApiProperty({ minLength: 1, example: 'citrus-fruits' })
  @IsString() @MinLength(1) slug!: string;
}

export class CreateProductDto {
  @ApiProperty({ example: 'store_123' })
  @IsString() storeId!: string;
  @ApiProperty({ example: 'category_123' })
  @IsString() categoryId!: string;
  @ApiProperty({ minLength: 1, example: 'Organic Apples' })
  @IsString() @MinLength(1) name!: string;
  @ApiPropertyOptional({ example: 'Crisp locally grown apples' })
  @IsOptional() @IsString() description?: string;
  @ApiProperty({ type: Number, minimum: 0, maximum: 99999999.99, example: 2.99 })
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price!: number;
  @ApiPropertyOptional({ format: 'uri', example: 'https://example.com/apples.jpg' })
  @IsOptional() @IsString() @Validate(ProductImageLocationConstraint) imageUrl?: string;
  @ApiProperty({ type: Number, minimum: 0, example: 25 })
  @Type(() => Number) @IsInt() @Min(0) quantity!: number;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ minLength: 1, example: 'Organic Gala Apples' })
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @ApiPropertyOptional({ example: 'category_123' })
  @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional({ example: 'Crisp locally grown apples' })
  @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 99999999.99, example: 3.49 })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price?: number;
  @ApiPropertyOptional({ format: 'uri', example: 'https://example.com/apples.jpg' })
  @IsOptional() @IsString() @Validate(ProductImageLocationConstraint) imageUrl?: string;
  @ApiPropertyOptional({ example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateInventoryDto {
  @ApiProperty({ type: Number, minimum: 0, example: 25 })
  @Type(() => Number) @IsInt() @Min(0) quantity!: number;
}

export class AddCartItemDto {
  @ApiProperty({ example: 'product_123' })
  @IsString() productId!: string;
  @ApiProperty({ type: Number, minimum: 1, example: 2 })
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'address_123' })
  @IsString() addressId!: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PROCESSING })
  @IsEnum(OrderStatus) status!: OrderStatus;
}

export class CreateDeliveryDto {
  @ApiProperty({ example: 'user_123' })
  @IsString() agentId!: string;
}

export class CreateDeliveryAgentDto {
  @ApiProperty({ format: 'email', example: 'driver@example.com' })
  @IsEmail() email!: string;
  @ApiProperty({ minLength: 8, example: 'strong-password' })
  @IsString() @MinLength(8) password!: string;
  @ApiProperty({ minLength: 1, example: 'Alex Driver' })
  @IsString() @MinLength(1) name!: string;
}

export class CreateAdminDto {
  @ApiProperty({ format: 'email', example: 'admin@example.com' })
  @IsEmail() email!: string;
  @ApiProperty({ minLength: 8, example: 'strong-password' })
  @IsString() @MinLength(8) password!: string;
  @ApiProperty({ minLength: 1, example: 'Administrator' })
  @IsString() @MinLength(1) name!: string;
}

export class UpdateDeliveryStatusDto {
  @ApiProperty({ enum: DeliveryStatus, example: DeliveryStatus.IN_TRANSIT })
  @IsEnum(DeliveryStatus) status!: DeliveryStatus;
  @ApiPropertyOptional({ example: 'Package is on the way' })
  @IsOptional() @IsString() trackingNote?: string;
}

export class CheckoutDto {
  @ApiProperty({ example: 'order_123' })
  @IsString() orderId!: string;
  @ApiPropertyOptional({ enum: PaymentMethod, example: PaymentMethod.ONLINE, default: PaymentMethod.ONLINE })
  @IsOptional() @IsEnum(PaymentMethod) paymentMethod?: PaymentMethod;
}

export class CreateAddressDto {
  @ApiProperty({ minLength: 1, example: 'Jane Customer' })
  @IsString() @MinLength(1) recipient!: string;
  @ApiProperty({ minLength: 1, example: '+15551234567' })
  @IsString() @MinLength(1) phone!: string;
  @ApiProperty({ minLength: 1, example: '123 Market Street' })
  @IsString() @MinLength(1) line1!: string;
  @ApiPropertyOptional({ example: 'Apartment 4B' })
  @IsOptional() @IsString() line2?: string;
  @ApiProperty({ minLength: 1, example: 'Springfield' })
  @IsString() @MinLength(1) city!: string;
  @ApiProperty({ minLength: 1, example: '12345' })
  @IsString() @MinLength(1) postalCode!: string;
}
