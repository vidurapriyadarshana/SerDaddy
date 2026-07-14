import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encrypt } from '../utils/crypto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProject(userId: string, data: { serverId: string; repoUrl: string; branch: string; subdomain: string }) {
    // Check if subdomain is already taken
    const existing = await this.prisma.project.findUnique({
      where: { subdomain: data.subdomain },
    });
    if (existing) {
      throw new BadRequestException(`Subdomain "${data.subdomain}" is already mapped to another project.`);
    }

    // Auto-allocate next unique port (starting at 3001)
    const maxPortProject = await this.prisma.project.findFirst({
      orderBy: { port: 'desc' },
    });
    const assignedPort = maxPortProject ? maxPortProject.port + 1 : 3001;

    return this.prisma.project.create({
      data: {
        repoUrl: data.repoUrl,
        branch: data.branch || 'main',
        subdomain: data.subdomain,
        port: assignedPort,
        status: 'READY',
        serverId: data.serverId,
        userId,
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.project.findMany({
      where: { userId },
      include: {
        server: { select: { name: true, ip: true } },
        _count: { select: { deployments: true } },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, userId },
      include: {
        server: true,
        deployments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        environmentVariables: {
          select: { key: true, createdAt: true }, // Don't expose encrypted values on inspect
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }

    return project;
  }

  async addEnvVariable(projectId: string, key: string, value: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    // Encrypt the value before writing to DB
    const encryptedValue = encrypt(value);

    return this.prisma.environmentVariable.upsert({
      where: {
        projectId_key: { projectId, key },
      },
      update: { value: encryptedValue },
      create: { projectId, key, value: encryptedValue },
    });
  }

  async removeEnvVariable(projectId: string, key: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found.`);
    }

    try {
      return await this.prisma.environmentVariable.delete({
        where: {
          projectId_key: { projectId, key },
        },
      });
    } catch (err) {
      throw new NotFoundException(`Environment variable with key "${key}" not found.`);
    }
  }
}
