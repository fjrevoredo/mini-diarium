{
  description = "Mini Diarium — an encrypted, local-first desktop journaling application";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f system nixpkgs.legacyPackages.${system});
    in
    {
      packages = forAllSystems (
        _system: pkgs: rec {
          mini-diarium = pkgs.callPackage ./nix/package.nix { };
          default = mini-diarium;
        }
      );

      overlays.default = final: _prev: {
        mini-diarium = final.callPackage ./nix/package.nix { };
      };

      nixosModules.default = import ./nix/nixos-module.nix self;
      homeModules.default = import ./nix/hm-module.nix self;

      devShells = forAllSystems (
        system: pkgs: {
          default = pkgs.mkShell {
            inputsFrom = [ self.packages.${system}.default ];
            packages = with pkgs; [
              nodejs
              bun
              cargo
              rustc
              rust-analyzer
            ];
          };
        }
      );

      formatter = forAllSystems (_system: pkgs: pkgs.nixfmt);
    };
}
