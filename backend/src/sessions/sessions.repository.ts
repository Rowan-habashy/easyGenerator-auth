import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { SessionDocument, SessionEntity } from './session.schema';

@Injectable()
export class SessionsRepository {
  constructor(@InjectModel(SessionEntity.name) private readonly model: Model<SessionEntity>) {}

  async create(userId: string, expiresAt: Date, session?: ClientSession): Promise<SessionDocument> {
    const [doc] = await this.model.create([{ userId: new Types.ObjectId(userId), expiresAt }], {
      session,
    });
    return doc;
  }

  findById(id: string): Promise<SessionDocument | null> {
    return this.model.findById(id).exec();
  }

  async revoke(id: string, reason: string, session?: ClientSession): Promise<void> {
    await this.model
      .updateOne({ _id: id, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } }, { session })
      .exec();
  }

  async touch(id: string, session?: ClientSession): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: { lastUsedAt: new Date() } }, { session }).exec();
  }
}
