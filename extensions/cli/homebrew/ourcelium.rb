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
  url "https://registry.npmjs.org/@ourcelium/cli/-/cli-0.1.3.tgz"
  sha256 "62658b85097258e9f75ed224032103dcf8b2f7478b4f099f5e1cdf1c757e4ffb"
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
