self:
{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.programs.mini-diarium;
in
{
  options.programs.mini-diarium = {
    enable = lib.mkEnableOption "Mini Diarium, an encrypted local-first journaling app";

    package = lib.mkPackageOption self.packages.${pkgs.stdenv.hostPlatform.system} "mini-diarium" {
      default = "default";
    };
  };

  config = lib.mkIf cfg.enable {
    environment.systemPackages = [ cfg.package ];
  };
}
