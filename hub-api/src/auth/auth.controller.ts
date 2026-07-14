import { Controller, Get, Query, Res, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Get('repos')
  async getRepos(@Headers('x-user-id') userId: string) {
    return this.service.fetchUserRepos(userId);
  }

  @Get('github')
  async login(@Res() res: any) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_CALLBACK_URL || 'http://localhost:4000/api/auth/github/callback';

    // Graceful fallback if Client OAuth keys are not configured in local sandbox
    if (!clientId) {
      console.log('⚠️ GITHUB_CLIENT_ID is missing. Falling back to mock login credentials...');
      
      const mockUser = await this.service.findOrCreateUser(
        {
          login: 'local_sandbox_dev',
          email: 'sandbox@serdaddy.local',
          avatar_url: 'https://avatars.githubusercontent.com/u/9919?v=4',
        },
        'MOCK_GITHUB_TOKEN'
      );

      const targetUrl = `http://localhost:3000/dashboard?userId=${mockUser.id}&username=${
        mockUser.username
      }&avatarUrl=${encodeURIComponent(mockUser.avatarUrl || '')}`;

      res.raw.writeHead(302, { Location: targetUrl });
      res.raw.end();
      return;
    }

    // Redirect browser to Github OAuth endpoint
    const authorizeUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=repo,user`;

    res.raw.writeHead(302, { Location: authorizeUrl });
    res.raw.end();
  }

  @Get('github/callback')
  async callback(@Query('code') code: string, @Res() res: any) {
    if (!code) {
      res.raw.writeHead(302, { Location: 'http://localhost:3000/?error=access_denied' });
      res.raw.end();
      return;
    }

    try {
      // 1. Exchange code for access token
      const token = await this.service.exchangeCode(code);

      // 2. Load user profile
      const profile = await this.service.fetchUserProfile(token);

      // 3. Upsert User in database
      const user = await this.service.findOrCreateUser(profile, token);

      // 4. Redirect client dashboard with token parameters
      const dashboardUrl = `http://localhost:3000/dashboard?userId=${user.id}&username=${
        user.username
      }&avatarUrl=${encodeURIComponent(user.avatarUrl || '')}`;

      res.raw.writeHead(302, { Location: dashboardUrl });
      res.raw.end();
    } catch (err: any) {
      console.error('GitHub Auth callback error:', err.message);
      const errorUrl = `http://localhost:3000/?error=${encodeURIComponent(err.message)}`;
      res.raw.writeHead(302, { Location: errorUrl });
      res.raw.end();
    }
  }
}
