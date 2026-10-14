export class RegisterDto {
  email: string;
  phone: string;
  role: 'CUSTOMER' | 'PROVIDER' | 'BOTH';
  firstName?: string;
  lastName?: string;
  businessName?: string;
  providerType?: 'MECHANIC' | 'GARAGE' | 'PARTS_DEALER' | 'TOWING' | 'ROADSIDE';
  address?: string;
  latitude?: number;
  longitude?: number;
}

export class LoginDto {
  email: string;
  password?: string;
}
