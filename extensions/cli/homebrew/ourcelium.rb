# Homebrew formula for the Ourcelium CLI.
#
# Canonical home: the tap repo `novaheic/homebrew-ourcelium` (this file goes in
# its `Formula/` directory). A copy is kept here in the client repo so the
# formula is version-controlled alongside the code it installs.
#
# To publish a new version:
#   1. `npm publish` @ourcelium/cli (from extensions/cli)
#   2. Update `url` to the new version and refresh `sha256`:
#        curl -sL https://registry.npmjs.org/@ourcelium/cli/-/cli-<VERSION>.tgz | shasum -a 256
#   3. Commit to the tap repo.
class Ourcelium < Formula
  desc "Plug-and-play AI coding assistant powered by open models"
  homepage "https://ourcelium.dev"
  url "https://registry.npmjs.org/@ourcelium/cli/-/cli-0.1.2.tgz"
  sha256 "5fc6b83a11c96802ef9dd30d3221102022a4b3168e8d6fb86e1e6ec7fe46119a"
  license "Apache-2.0"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/ourcelium --version 2>&1")
  end
end
