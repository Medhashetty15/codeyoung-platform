import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { type Me } from '@app/contracts';

import { type AuthenticatedUser, CurrentUser } from '../../../common/auth/authenticated-user';
import { ProfileService } from '../application/profile.service';

import { UpdateMeDto } from './me.dto';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<Me> {
    return this.profile.get(user.userId);
  }

  @Patch()
  update(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateMeDto): Promise<Me> {
    return this.profile.update(user.userId, body);
  }
}
