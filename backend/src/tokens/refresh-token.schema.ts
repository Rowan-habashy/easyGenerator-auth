import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { REFRESH_TOKENS_COLLECTION } from './tokens.constants';

@Schema({ collection: REFRESH_TOKENS_COLLECTION, timestamps: { createdAt: true, updatedAt: false } })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'SessionEntity', required: true, index: true })
  sessionId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  @Prop({ type: Types.ObjectId, ref: 'RefreshToken', default: null })
  replacedBy: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  usedAt: Date | null;

  @Prop({ type: Date, default: null })
  revokedAt: Date | null;

  @Prop({ required: true })
  expiresAt: Date;

  createdAt: Date;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
