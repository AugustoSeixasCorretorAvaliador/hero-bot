# OTA — Over-the-air update architecture

Objetivo: adicionar interfaces e fluxo para atualizações seguras e gerenciáveis.

Componentes
- `OTAService` — interface para checar versões remotas, baixar e validar firmware.
- `FirmwareUpdater` — aplica imagem (with rollback support)
- `VersionManager` — mantém metadados de versão, release notes

Design
- Não implementar política de distribuição nesta fase; fornecer interfaces e um stub que baixa uma imagem de um servidor local/HTTP.
- Validar checksums (SHA256) antes de aplicar.
- Support A/B or rollback plan.

APIs (sketch)
- `OTAService::checkForUpdate()`
- `OTAService::downloadUpdate(url, checksum)`
- `FirmwareUpdater::apply(image)`
