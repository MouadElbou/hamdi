/**
 * Import service — handles historical spreadsheet data import
 * with anomaly detection and raw value preservation.
 */

import type { PrismaClient } from '@prisma/client';
import {
  normalizeBoutique,
  normalizeCategory,
  normalizeSupplier,
  normalizeExpenseDesignation,
} from '@stock/shared';

export interface ImportRow {
  entityType: string;
  rawData: Record<string, string>;
}

interface AnomalyRecord {
  entityType: string;
  entityId: string | null;
  anomalyType: string;
  rawValue: string;
  canonicalValue: string | null;
  description: string;
}

export class ImportService {
  constructor(private prisma: PrismaClient) { }

  /** Import a batch of historical records */
  async importBatch(fileName: string, rows: ImportRow[]): Promise<{
    batchId: string;
    importedRows: number;
    anomalyCount: number;
    anomalies: AnomalyRecord[];
  }> {
    const anomalies: AnomalyRecord[] = [];
    let importedRows = 0;

    const batch = await this.prisma.importBatch.create({
      data: {
        fileName,
        status: 'running',
        totalRows: rows.length,
      },
    });

    for (const row of rows) {
      try {
        const rowAnomalies = this.detectAnomalies(row);
        anomalies.push(...rowAnomalies);
        // Only count as imported if there were no anomalies for this row
        if (rowAnomalies.length === 0) importedRows++;
      } catch (err) {
        anomalies.push({
          entityType: row.entityType,
          entityId: null,
          anomalyType: 'import_error',
          rawValue: JSON.stringify(row.rawData),
          canonicalValue: null,
          description: err instanceof Error ? err.message : 'Unknown import error',
        });
      }
    }

    // Record anomalies
    for (const anomaly of anomalies) {
      await this.prisma.importAnomaly.create({
        data: {
          entityType: anomaly.entityType,
          entityId: anomaly.entityId,
          anomalyType: anomaly.anomalyType,
          rawValue: anomaly.rawValue,
          canonicalValue: anomaly.canonicalValue,
          description: anomaly.description,
          importBatchId: batch.id,
        },
      });
    }

    await this.prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: anomalies.some((a) => a.anomalyType === 'import_error') ? 'failed' : 'completed',
        completedAt: new Date(),
        importedRows,
        anomalyCount: anomalies.length,
      },
    });

    return { batchId: batch.id, importedRows, anomalyCount: anomalies.length, anomalies };
  }

  /** Detect anomalies in a single import row */
  private detectAnomalies(row: ImportRow): AnomalyRecord[] {
    const anomalies: AnomalyRecord[] = [];

    // Check boutique normalization
    if (row.rawData['boutique']) {
      const canonical = normalizeBoutique(row.rawData['boutique']);
      if (!canonical) {
        anomalies.push({
          entityType: row.entityType,
          entityId: null,
          anomalyType: 'invalid_boutique',
          rawValue: row.rawData['boutique'],
          canonicalValue: null,
          description: `Boutique '${row.rawData['boutique']}' does not match any canonical value`,
        });
      } else if (canonical !== row.rawData['boutique']) {
        anomalies.push({
          entityType: row.entityType,
          entityId: null,
          anomalyType: 'boutique_alias',
          rawValue: row.rawData['boutique'],
          canonicalValue: canonical,
          description: `Boutique '${row.rawData['boutique']}' normalized to '${canonical}'`,
        });
      }
    }

    // Check category normalization
    if (row.rawData['category']) {
      const canonical = normalizeCategory(row.rawData['category']);
      if (!canonical) {
        anomalies.push({
          entityType: row.entityType,
          entityId: null,
          anomalyType: 'invalid_category',
          rawValue: row.rawData['category'],
          canonicalValue: null,
          description: `Category '${row.rawData['category']}' does not match any canonical value`,
        });
      } else if (canonical !== row.rawData['category']) {
        anomalies.push({
          entityType: row.entityType,
          entityId: null,
          anomalyType: 'category_alias',
          rawValue: row.rawData['category'],
          canonicalValue: canonical,
          description: `Category '${row.rawData['category']}' normalized to '${canonical}'`,
        });
      }
    }

    // Check supplier normalization
    if (row.rawData['supplier']) {
      const canonical = normalizeSupplier(row.rawData['supplier']);
      if (!canonical) {
        anomalies.push({
          entityType: row.entityType,
          entityId: null,
          anomalyType: 'invalid_supplier',
          rawValue: row.rawData['supplier'],
          canonicalValue: null,
          description: `Supplier '${row.rawData['supplier']}' does not match any canonical value`,
        });
      }
    }

    // Check designation '0' placeholder
    if (row.rawData['designation'] && row.rawData['designation'].trim() === '0') {
      anomalies.push({
        entityType: row.entityType,
        entityId: null,
        anomalyType: 'placeholder_designation',
        rawValue: '0',
        canonicalValue: null,
        description: 'Designation contains placeholder value "0"',
      });
    }

    // Check expense designation alias
    if (row.entityType === 'expense' && row.rawData['designation']) {
      const normalized = normalizeExpenseDesignation(row.rawData['designation']);
      if (normalized !== row.rawData['designation']) {
        anomalies.push({
          entityType: row.entityType,
          entityId: null,
          anomalyType: 'expense_alias',
          rawValue: row.rawData['designation'],
          canonicalValue: normalized,
          description: `Expense designation normalized from '${row.rawData['designation']}' to '${normalized}'`,
        });
      }
    }

    return anomalies;
  }
}
