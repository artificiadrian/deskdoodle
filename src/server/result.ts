/** Bases for operation results. Variants add their own `error` tag to `Failure`. */

export type Success = { readonly success: true };

export type Failure = { readonly success: false };

/**
 * What a provider needed and could not find.
 * `all` lists the commands that are missing; `any` lists the candidates, none of which exist.
 */
export type CommandNeeds =
  | { readonly kind: "all"; readonly commands: readonly string[] }
  | { readonly kind: "any"; readonly commands: readonly string[] };

/** The provider's external tools are all present. */
export type Available = Success;

/** The provider cannot run. */
export type Unavailable = Failure & {
  readonly error: "unavailable";
  readonly needs: CommandNeeds;
};

export type Availability = Available | Unavailable;
