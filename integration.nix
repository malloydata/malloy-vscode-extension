with import <nixpkgs> {};
stdenv.mkDerivation {
  name = "malloy";
  buildInputs = [
    nodejs-16_x
    git
    turbovnc
    vscode
    which
  ];
}
