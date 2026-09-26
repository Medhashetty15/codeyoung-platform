import { createZodDto } from 'nestjs-zod';

import { UpdateMeRequestSchema } from '@app/contracts';

export class UpdateMeDto extends createZodDto(UpdateMeRequestSchema) {}
