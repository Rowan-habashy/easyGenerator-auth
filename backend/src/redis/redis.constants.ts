export const REDIS = Symbol('REDIS');

export const REDIS_KEY = {
  throttle: 'throttle',
  signinFailIp: 'signin:fail:ip',
  signinFailEmail: 'signin:fail:email',
} as const;
