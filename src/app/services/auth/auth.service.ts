import {Location} from "@angular/common";
import {Injectable} from "@angular/core";
import {Router} from "@angular/router";
import {OAuthService} from "angular-oauth2-oidc";
import {first} from "rxjs/operators";
import {environment} from "../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class AuthService {
  // Promise that resolves once the login has been successful.
  // This only works for forceful logins.
  readonly initialized: Promise<unknown>;

  get claims(): {email: string; name: string; roles: string[]} {
    return this.oauthService.getIdentityClaims() as {
      email: string;
      name: string;
      roles: string[];
    };
  }

  get scopes(): string[] {
    return this.oauthService.getGrantedScopes() as string[];
  }

  constructor(
    private oauthService: OAuthService,
    private router: Router,
    location: Location,
  ) {
    if (environment.disableBackend) return;
    this.oauthService.configure(environment.authConfig);
    this.oauthService.setupAutomaticSilentRefresh();
    // If the user should not be forcefully logged in (e.g. if you have pages, which can be
    // accessed anonymously), change loadDiscoveryDocumentAndLogin to
    // loadDiscoveryDocumentAndTryLogin and have a login functionality in the
    // template of the component injecting the AuthService which calls the login() method.
    this.initialized = this.oauthService
      .loadDiscoveryDocumentAndLogin({state: location.path()})
      // If the user is not logged in, he will be forwarded to the identity provider
      // and this promise will not resolve. After being redirected from the identity
      // provider, the login promise will return true.
      .then((v) => (v ? true : new Promise(() => {})));
    // Redirect the user to the url configured with state above or in a separate login call.
    this.oauthService.events.pipe(first((e) => e.type === "token_received")).subscribe(() => {
      const state = decodeURIComponent(this.oauthService.state || "");
      if (state && state !== "/") {
        this.router.navigate([state]);
      }
    });
  }

  logOut() {
    return this.oauthService.logOut(false);
  }

  async hasRole(role: string) {
    // Await the successful login of the user.
    await this.initialized;
    // Using indexOf for IE11 compatibility.
    return this.claims && Array.isArray(this.claims.roles) && this.claims.roles.indexOf(role) >= 0;
  }
}
