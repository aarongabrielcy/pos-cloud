import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import type { AdminSession } from "../../domain/admin-session";
import type { AdminSessionId } from "../../domain/admin-session-id";
import type { AdminSessionRepository } from "../../domain/admin-session-repository.port";
import { AdminSessionMapper } from "./admin-session.mapper";
import { AdminSessionRecord } from "./admin-session.record";

/** Plain (non-transactional) session persistence - see AdminSessionRepository's own comment for when this is (and isn't) enough. */
@Injectable()
export class TypeOrmAdminSessionRepository implements AdminSessionRepository {
  constructor(
    @InjectRepository(AdminSessionRecord)
    private readonly repository: Repository<AdminSessionRecord>,
  ) {}

  async findById(id: AdminSessionId): Promise<AdminSession | null> {
    const record = await this.repository.findOne({ where: { id: id.toString() } });
    return record ? AdminSessionMapper.toDomain(record) : null;
  }

  async save(session: AdminSession): Promise<void> {
    await this.repository.save(AdminSessionMapper.toRecord(session));
  }
}
