export const ROLES = [
  'customer',
  'admin',
  'operations',
  'partner_staff',
  'rider',
  'support',
] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface User {
  id: string;
  name: string;
  /** Normalized E.164 phone; unique identity for login. */
  phone: string;
  passwordHash: string;
  roles: Role[];
  status: UserStatus;
  /** Required scope for partner_staff; absent for other roles. */
  partnerId?: string;
  phoneVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Public projection of a user — never includes the password hash. */
export interface UserDTO {
  id: string;
  name: string;
  phone: string;
  roles: Role[];
  status: UserStatus;
  partnerId?: string;
}

export function toUserDTO(user: User): UserDTO {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    roles: user.roles,
    status: user.status,
    ...(user.partnerId ? { partnerId: user.partnerId } : {}),
  };
}
