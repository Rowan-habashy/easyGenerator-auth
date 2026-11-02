import { Injectable } from '@nestjs/common';
import { ClientSession } from 'mongoose';
import { UserDocument } from './user.schema';
import { UsersRepository } from './users.repository';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export const toPublicUser = (u: UserDocument): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  createdAt: u.createdAt,
});

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  findByEmail(email: string) {
    return this.repo.findByEmail(email);
  }

  findById(id: string) {
    return this.repo.findById(id);
  }

  create(data: { email: string; name: string; passwordHash: string }, session?: ClientSession) {
    return this.repo.create(data, session);
  }
}
