import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { SESSIONS_COLLECTION } from './sessions.constants';

@Schema({ collection: SESSIONS_COLLECTION, timestamps: { createdAt: true, updatedAt: false } })
export class SessionEntity {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ default: () => new Date() })
  lastUsedAt: Date;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;

  @Prop({ type: String, default: null })
  revokedReason: string | null;

  createdAt: Date;
}

export type SessionDocument = HydratedDocument<SessionEntity>;
export const SessionSchema = SchemaFactory.createForClass(SessionEntity);
