import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

// JWT payload'dagi rol. Bitta endpointni bir nechta rol ishlatganda
// (masalan, ORGANIZER o'zinikini, ADMIN istalganini bekor qiladi) kerak bo'ladi.
export const UserRole = createParamDecorator(
  (_key: string | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const role = req.user?.role;
    if (!role) {
      throw new UnauthorizedException('Foydalanuvchi topilmadi');
    }
    return String(role);
  },
);
