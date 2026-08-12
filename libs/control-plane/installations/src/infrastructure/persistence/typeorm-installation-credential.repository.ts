import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, type Repository } from "typeorm";
import type { InstallationCredentialRepository } from "../../application/ports/installation-credential-repository.port";
import type { InstallationCredential } from "../../domain/installation-credential";
import { InstallationCredentialMapper } from "./installation-credential.mapper";
import { InstallationCredentialRecord } from "./installation-credential.record";

@Injectable()
export class TypeOrmInstallationCredentialRepository implements InstallationCredentialRepository {
  constructor(
    @InjectRepository(InstallationCredentialRecord)
    private readonly repository: Repository<InstallationCredentialRecord>,
  ) {}

  async findActiveByInstallationId(installationId: string): Promise<InstallationCredential | null> {
    const record = await this.repository.findOne({
      where: { installationId, revokedAt: IsNull() },
    });
    return record ? InstallationCredentialMapper.toDomain(record) : null;
  }

  async save(credential: InstallationCredential): Promise<void> {
    await this.repository.save(InstallationCredentialMapper.toRecord(credential));
  }
}
