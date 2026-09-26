import { createZodDto } from 'nestjs-zod';

import { SlotsQuerySchema } from '@app/contracts';

export class SlotsQueryDto extends createZodDto(SlotsQuerySchema) {}
