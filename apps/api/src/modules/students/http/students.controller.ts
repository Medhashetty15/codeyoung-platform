import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { type Student } from '@app/contracts';

import { type AuthenticatedUser, CurrentUser } from '../../../common/auth/authenticated-user';
import { StudentsService } from '../application/students.service';

import { CreateStudentDto, UpdateStudentDto } from './students.dto';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me/students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<Student[]> {
    return this.students.list(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateStudentDto): Promise<Student> {
    return this.students.create(user.userId, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateStudentDto,
  ): Promise<Student> {
    return this.students.update(user.userId, id, body);
  }
}
