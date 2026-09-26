import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';

import { type Student } from '@app/contracts';

import { type AuthenticatedUser, CurrentUser } from '../../../common/auth/authenticated-user';
import { ApiProblems, StudentDto } from '../../../common/http/api-docs';
import { StudentsService } from '../application/students.service';

import { CreateStudentDto, UpdateStudentDto } from './students.dto';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me/students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @ApiResponse({ status: 200, type: [StudentDto] })
  @ApiProblems('UNAUTHENTICATED')
  list(@CurrentUser() user: AuthenticatedUser): Promise<Student[]> {
    return this.students.list(user.userId);
  }

  @Post()
  @ApiResponse({ status: 201, type: StudentDto })
  @ApiProblems('UNAUTHENTICATED', 'STUDENT_NAME_TAKEN')
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateStudentDto): Promise<Student> {
    return this.students.create(user.userId, body);
  }

  @Patch(':id')
  @ApiResponse({ status: 200, type: StudentDto })
  @ApiProblems('UNAUTHENTICATED', 'STUDENT_NOT_FOUND', 'STUDENT_NAME_TAKEN')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateStudentDto,
  ): Promise<Student> {
    return this.students.update(user.userId, id, body);
  }
}
