class Streambreak < Formula
  desc "Break time content during AI coding waits"
  homepage "https://github.com/rhc98/streambreak"
  version "0.2.0"
  url "https://github.com/rhc98/streambreak/releases/download/v0.2.0/streambreak-universal-apple-darwin.tar.gz"
  sha256 "8d9196a38428d2398fb309a28474bdd8735edd236b8fd2ed257aabedf75140f3"

  on_macos do
    # macOS only
  end

  def install
    bin.install "streambreak"
  end

  def caveats
    <<~EOS
      If macOS blocks the binary (Gatekeeper), run:
        xattr -d com.apple.quarantine #{bin}/streambreak

      Then set up Claude Code hooks:
        streambreak init
    EOS
  end

  test do
    system "#{bin}/streambreak", "--version"
  end
end
