import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';

import { type ClassroomView } from '@app/contracts';

import { Public } from '../../../common/auth/public.decorator';
import { ApiProblems, ClassroomViewDto } from '../../../common/http/api-docs';
import { ClassroomService } from '../application/classroom.service';

@ApiTags('classroom')
@Public()
@Controller('classroom')
export class ClassroomController {
  constructor(private readonly classrooms: ClassroomService) {}

  /** Personal join link lookup (docs/03 §8); unknown or malformed tokens are 404. */
  @Get(':joinToken')
  @ApiResponse({ status: 200, type: ClassroomViewDto })
  @ApiProblems('CLASSROOM_NOT_FOUND')
  @Header('Cache-Control', 'no-store')
  view(@Param('joinToken') joinToken: string): Promise<ClassroomView> {
    return this.classrooms.view(joinToken);
  }
}
