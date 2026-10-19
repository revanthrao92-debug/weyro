export class VerifyProviderDto {
  status: 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  auditorNotes?: string;
}
