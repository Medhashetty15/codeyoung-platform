import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'cy:isPublic';

/** Opts a route out of the global access-token guard (secure by default, docs/03 §6.4). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);
