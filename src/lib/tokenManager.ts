import { supabase } from "@/supabase/client";

interface TokenRefreshResult {
  success: boolean;
  token?: string;
  error?: string;
}

class TokenManager {
  private static instance: TokenManager;
  private refreshPromise: Promise<TokenRefreshResult> | null = null;

  private constructor() {}

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Fuerza el refresh del token llamando a la Edge Function
   */
  async forceTokenRefresh(): Promise<TokenRefreshResult> {
    // Si ya hay un refresh en progreso, esperar a que termine
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Crear nueva promesa de refresh
    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      // Limpiar la promesa después de completarse
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<TokenRefreshResult> {
    try {
      console.log("[TokenManager] Iniciando refresh del token...");
      
      // Obtener la sesión actual
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: "No hay sesión activa" };
      }

      // Llamar a la Edge Function para refrescar el token
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/store-google-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "refresh",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[TokenManager] Error al refrescar token:", errorData);
        return { success: false, error: errorData.error || "Error al refrescar token" };
      }

      const result = await response.json();
      console.log("[TokenManager] Token refrescado exitosamente");
      return { success: true, token: result.token };
    } catch (error) {
      console.error("[TokenManager] Error durante el refresh:", error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Error desconocido" 
      };
    }
  }

  /**
   * Wrapper para llamadas a la API que refresca el token automáticamente si falla
   */
  async callWithTokenRefresh<T>(
    apiCall: () => Promise<Response>,
    retryCount = 0
  ): Promise<T> {
    try {
      const response = await apiCall();
      
      // Si la respuesta es 401 (no autorizado), intentar refrescar el token
      if (response.status === 401 && retryCount < 2) {
        console.log("[TokenManager] Token expirado, intentando refrescar...");
        
        const refreshResult = await this.forceTokenRefresh();
        if (refreshResult.success) {
          // Reintentar la llamada original
          return this.callWithTokenRefresh<T>(apiCall, retryCount + 1);
        } else {
          throw new Error(`Error al refrescar token: ${refreshResult.error}`);
        }
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error HTTP: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[TokenManager] Error en llamada API:", error);
      throw error;
    }
  }
}

export const tokenManager = TokenManager.getInstance(); 