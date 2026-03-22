
1. Push the agent-server repo to GitHub (if not already):
cd /Users/konradgnat/dev/startups/network/agent-server
git remote add origin <your-github-repo-url>
git push -u origin main
2. Add 3 GitHub Secrets (repo Settings → Secrets → Actions):

| Secret      | Value                                |
|-------------|--------------------------------------|
| VPS_HOST    | 146.190.161.168                      |
| VPS_USER    | deploy                               |
| VPS_SSH_KEY | Your SSH private key for deploy user |

2. To generate a deploy key:
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/nanoclaw_deploy -N ""
ssh-copy-id -i ~/.ssh/nanoclaw_deploy.pub deploy@146.190.161.168
cat ~/.ssh/nanoclaw_deploy   # paste as VPS_SSH_KEY secret
3. Test: GitHub → Actions → "Run workflow" manually, or push a change

Type "cicd-verified" when done, or "skip-cicd" to defer and move to the e2e test.