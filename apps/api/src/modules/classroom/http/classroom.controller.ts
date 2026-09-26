import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { type ClassroomView } from '@app/contracts';

import { Public } from '../../../common/auth/public.decorator';
import { ClassroomService } from '../application/classroom.service';

@ApiTags('classroom')
@Public()
@Controller('classroom')
export class ClassroomController {
  constructor(private readonly classrooms: ClassroomService) {}

  /** Personal join link lookup (docs/03 §8); unknown or malformed tokens are 404. */
  @Get(':joinToken')
  @Header('Cache-Control', 'no-store')
  view(@Param('joinToken') joinToken: string): Promise<ClassroomView> {
    return this.classrooms.view(joinToken);
  }
}
