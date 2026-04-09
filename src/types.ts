export interface Account {
  id: string;
  label: string;
  services: string[];
}

export interface AccountsConfig {
  accounts: Account[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

export interface ServiceModule {
  name: string;
  tools: ToolDefinition[];
  handlers: Record<string, ToolHandler>;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type: string;
  scope: string;
}

export interface TokenStore {
  [accountId: string]: {
    [service: string]: OAuthTokens;
  };
}

export interface GoogleOAuthClient {
  installed: {
    client_id: string;
    client_secret: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    redirect_uris: string[];
  };
}
