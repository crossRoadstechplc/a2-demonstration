export type SidebarState = "expanded" | "collapsed";
export type ThemeMode = "dark" | "light";

export interface UiState {
  sidebarState: SidebarState;
  themeMode: ThemeMode;
  activeOrganizationId: string | null;
  isMobileMenuOpen: boolean;
}
