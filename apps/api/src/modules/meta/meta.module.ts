import { Module } from '@nestjs/common';

import { MetaController } from './http/meta.controller';

@Module({ controllers: [MetaController] })
export class MetaModule {}
