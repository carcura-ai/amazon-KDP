import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../core/errors.js';
import { computeEntitlements, featureForRoute, FEATURES, type Entitlements, type FeatureKey } from '../core/entitlements.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Lazy berechnete Entitlements des Mandanten dieser Anfrage. */
    entitlements(): Entitlements;
  }
  interface FastifyInstance {
    entitlementsFor: (companyId: string) => Entitlements;
    hasFeature: (companyId: string, feature: FeatureKey) => boolean;
    requireFeature: (feature: FeatureKey) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** Routen, die auch ohne aktives Abo schreibend nutzbar bleiben: Anmeldung, Vertrag, Datenschutz, Export. */
const ALWAYS_WRITABLE = ['/api/auth/', '/api/subscription', '/api/support', '/api/privacy/', '/api/tenant-export', '/api/export/', '/api/legal/'];

export class FeatureError extends AppError {
  constructor(feature: FeatureKey) {
    super(402, 'feature_not_included', `Das Modul „${FEATURES[feature]}“ ist in Ihrem Tarif nicht enthalten. Sie können es unter Einstellungen → Vertrag & Abo hinzubuchen.`, [{ path: 'feature', message: feature }]);
  }
}

/**
 * Serverseitige Prüfung der gebuchten Module und des Abo-Status für jede Anfrage.
 * Deaktivieren eines Moduls sperrt nur den Zugriff; es werden keine Daten gelöscht.
 */
export default fp(async (app) => {
  const forCompany = (companyId: string) => computeEntitlements(app.db, companyId, app.config.deploymentMode);
  app.decorate('entitlementsFor', forCompany);
  app.decorate('hasFeature', (companyId: string, feature: FeatureKey) => forCompany(companyId).features.has(feature));
  app.decorateRequest('entitlements', function (this: FastifyRequest) {
    const self = this as FastifyRequest & { _ent?: Entitlements };
    if (!self._ent) self._ent = forCompany(this.auth!.companyId);
    return self._ent;
  });
  app.decorate('requireFeature', (feature: FeatureKey) => async (req: FastifyRequest) => {
    if (req.auth && !req.entitlements().features.has(feature)) throw new FeatureError(feature);
  });

  app.addHook('preHandler', async (req) => {
    if (!req.auth || app.config.deploymentMode === 'selfhosted') return;
    const url = req.routeOptions.url ?? req.url;
    const ent = req.entitlements();
    const feature = featureForRoute(url, req.method);
    if (feature && !ent.features.has(feature)) throw new FeatureError(feature);
    if (!ent.canWrite && req.method !== 'GET' && !ALWAYS_WRITABLE.some((p) => url.startsWith(p))) {
      throw new AppError(402, 'subscription_inactive', 'Ihr Abonnement ist nicht aktiv. Daten können angesehen und exportiert, aber nicht geändert werden. Bitte unter Einstellungen → Vertrag & Abo verlängern.');
    }
  });
});
