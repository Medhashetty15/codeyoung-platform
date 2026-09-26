import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';

import { type Me } from '@app/contracts';

import { type AuthenticatedUser, CurrentUser } from '../../../common/auth/authenticated-user';
import { ApiProblems, MeDto } from '../../../common/http/api-docs';
import { ProfileService } from '../application/profile.service';

import { UpdateMeDto } from './me.dto';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  @ApiResponse({ status: 200, type: MeDto })
  @ApiProblems('UNAUTHENTICATED')
  get(@CurrentUser() user: AuthenticatedUser): Promise<Me> {
    return this.profile.get(user.userId);
  }

  @Patch()
  @ApiResponse({ status: 200, type: MeDto })
  @ApiProblems('UNAUTHENTICATED', 'INVALID_TIMEZONE')
  update(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateMeDto): Promise<Me> {
    return this.profile.update(user.userId, body);
  }
}
