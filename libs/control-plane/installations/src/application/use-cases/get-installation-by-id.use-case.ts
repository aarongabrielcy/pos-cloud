import { Inject, Injectable } from "@nestjs/common";
import type { Installation } from "../../domain/installation";
import { InstallationId } from "../../domain/installation-id";
import {
  INSTALLATION_REPOSITORY,
  type InstallationRepository,
} from "../../domain/installation-repository.port";

@Injectable()
export class GetInstallationByIdUseCase {
  constructor(
    @Inject(INSTALLATION_REPOSITORY) private readonly installations: InstallationRepository,
  ) {}

  async execute(id: string): Promise<Installation | null> {
    return this.installations.findById(InstallationId.of(id));
  }
}
