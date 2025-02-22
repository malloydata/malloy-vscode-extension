with import <nixpkgs> {}; stdenv.mkDerivation { name = "malloy"; buildInputs = [ nodejs-20_x google-cloud-sdk git cacert fakeroot]; }
