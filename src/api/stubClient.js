/**
 * Empty client stub for production and non-mock development builds.
 */
export const db = {
  auth: {
    isAuthenticated: async () => false,
    me: async () => null,
    logout: (redirectUrl) => {
      if (redirectUrl) window.location.href = redirectUrl;
    },
    redirectToLogin: (fromUrl) => {
      const q = fromUrl ? `?from=${encodeURIComponent(fromUrl)}` : '';
      window.location.href = `/SignIn${q}`;
    },
  },
  entities: new Proxy(
    {},
    {
      get: () => ({
        filter: async () => [],
        get: async () => null,
        create: async (data) => ({ id: `local_${Date.now()}`, created_date: new Date().toISOString(), ...data }),
        update: async (id, data) => ({ id, updated_date: new Date().toISOString(), ...data }),
        delete: async () => ({}),
        list: async () => [],
      }),
    }
  ),
  integrations: {
    Core: {
      UploadFile: async () => ({ file_url: '' }),
    },
  },
};

export const base44 = db;
export default db;
