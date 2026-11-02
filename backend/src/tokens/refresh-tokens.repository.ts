import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { RefreshToken, RefreshTokenDocument } from './refresh-token.schema';

@Injectable()
export class RefreshTokensRepository {
  constructor(@InjectModel(RefreshToken.name) private readonly model: Model<RefreshToken>) {}

  async create(
    data: { _id?: Types.ObjectId; sessionId: string; tokenHash: string; expiresAt: Date },
    session?: ClientSession,
  ): Promise<RefreshTokenDocument> {
    const [doc] = await this.model.create(
      [{ ...data, sessionId: new Types.ObjectId(data.sessionId) }],
      { session },
    );
    return doc;
  }

  findByHash(tokenHash: string, session?: ClientSession): Promise<RefreshTokenDocument | null> {
    return this.model.findOne({ tokenHash }, null, { session }).exec();
  }

  findById(id: Types.ObjectId): Promise<RefreshTokenDocument | null> {
    return this.model.findById(id).exec();
  }

  async consume(id: Types.ObjectId, replacedBy: Types.ObjectId, session: ClientSession): Promise<boolean> {
    const res = await this.model
      .updateOne(
        { _id: id, usedAt: null, revokedAt: null },
        { $set: { usedAt: new Date(), replacedBy } },
        { session },
      )
      .exec();
    return res.modifiedCount === 1;
  }

  async revokeActiveBySession(sessionId: string, session?: ClientSession): Promise<void> {
    await this.model
      .updateMany(
        { sessionId: new Types.ObjectId(sessionId), revokedAt: null },
        { $set: { revokedAt: new Date() } },
        { session },
      )
      .exec();
  }
}
