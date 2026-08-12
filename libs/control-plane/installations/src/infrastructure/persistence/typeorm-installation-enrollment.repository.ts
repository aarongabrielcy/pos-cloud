import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import type { InstallationEnrollment } from "../../domain/installation-enrollment";
import type { InstallationEnrollmentId } from "../../domain/installation-enrollment-id";
import type { InstallationEnrollmentRepository } from "../../application/ports/installation-enrollment-repository.port";
import { InstallationEnrollmentMapper } from "./installation-enrollment.mapper";
import { InstallationEnrollmentRecord } from "./installation-enrollment.record";

@Injectable()
export class TypeOrmInstallationEnrollmentRepository implements InstallationEnrollmentRepository {
  constructor(
    @InjectRepository(InstallationEnrollmentRecord)
    private readonly repository: Repository<InstallationEnrollmentRecord>,
  ) {}

  async findById(id: InstallationEnrollmentId): Promise<InstallationEnrollment | null> {
    const record = await this.repository.findOne({ where: { id: id.toString() } });
    return record ? InstallationEnrollmentMapper.toDomain(record) : null;
  }
}
