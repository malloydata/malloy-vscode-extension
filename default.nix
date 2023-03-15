with import <nixpkgs> {}; stdenv.mkDerivation { name = "malloy"; buildInputs = [ nodejs-16_x google-cloud-sdk unzip git cacert fakeroot]; }
