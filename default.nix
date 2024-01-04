with import <nixpkgs> {}; stdenv.mkDerivation { name = "malloy"; buildInputs = [ nodejs-18_x google-cloud-sdk git cacert fakeroot]; }
