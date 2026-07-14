import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async exchangeCode(code: string): Promise<string> {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_CALLBACK_URL;

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to exchange authorization code with GitHub.');
    }

    const data: any = await response.json();
    if (data.error) {
      throw new BadRequestException(`GitHub OAuth Error: ${data.error_description || data.error}`);
    }

    return data.access_token;
  }

  async fetchUserProfile(accessToken: string): Promise<any> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'SerDaddy-PaaS-Hub',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to retrieve user profile details from GitHub.');
    }

    return response.json();
  }

  async findOrCreateUser(profile: any, accessToken: string) {
    return this.prisma.user.upsert({
      where: { username: profile.login },
      update: {
        githubToken: accessToken,
        email: profile.email || null,
        avatarUrl: profile.avatar_url || null,
      },
      create: {
        username: profile.login,
        githubToken: accessToken,
        email: profile.email || null,
        avatarUrl: profile.avatar_url || null,
      },
    });
  }

  async fetchUserRepos(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User profile not found.');
    }

    // Hand back sandbox mock repositories for quick testing if no oauth code is configured
    if (!user.githubToken || user.githubToken === 'MOCK_GITHUB_TOKEN') {
      return [
        {
          name: 'serdaddy-sample-api',
          fullName: `${user.username}/serdaddy-sample-api`,
          cloneUrl: 'https://github.com/vidurapriyadarshana/SerDaddy.git',
          defaultBranch: 'main',
          description: 'A mock api designed to test SerDaddy PaaS agent build daemons.',
        },
        {
          name: 'express-microservice-template',
          fullName: `${user.username}/express-microservice-template`,
          cloneUrl: 'https://github.com/expressjs/express.git',
          defaultBranch: 'master',
          description: 'Production-ready Express.js API boilerplate container.',
        },
        {
          name: 'nextjs-dashboard-boilerplate',
          fullName: `${user.username}/nextjs-dashboard-boilerplate`,
          cloneUrl: 'https://github.com/vercel/next.js.git',
          defaultBranch: 'canary',
          description: 'React panel admin workspace template.',
        }
      ];
    }

    try {
      const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: {
          'Authorization': `Bearer ${user.githubToken}`,
          'User-Agent': 'SerDaddy-PaaS-Hub',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('GitHub API responded with status ' + response.status);
      }

      const repos: any = await response.json();
      return repos.map((repo: any) => ({
        name: repo.name,
        fullName: repo.full_name,
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch || 'main',
        description: repo.description || 'No description provided.',
      }));
    } catch (err: any) {
      console.error('Failed to download repos from GitHub:', err.message);
      return [
        {
          name: 'serdaddy-fallback-api',
          fullName: `${user.username}/serdaddy-fallback-api`,
          cloneUrl: 'https://github.com/vidurapriyadarshana/SerDaddy.git',
          defaultBranch: 'main',
          description: 'Fallback local repository node.',
        }
      ];
    }
  }
}
