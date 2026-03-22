// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AgentEscrow
 * @notice Holds USDC in escrow for agent service jobs.
 *
 * Flow:
 *   1. Client calls createJob() — USDC transferred from client to this contract.
 *   2. Agent performs the work off-chain.
 *   3. Client calls releaseJob() — funds go to the agent.
 *   4. If dispute: either party calls disputeJob(), then the Treasury
 *      (mediator) calls resolveDispute() splitting funds as it sees fit.
 *
 * The Treasury address is set at deploy time and acts as the sole mediator.
 */
contract AgentEscrow {
    using SafeERC20 for IERC20;

    enum JobStatus { Active, Released, Disputed, Resolved, Refunded }

    struct Job {
        address client;
        address agent;
        uint256 amount;
        JobStatus status;
    }

    IERC20 public immutable usdc;
    address public immutable treasury;

    uint256 public nextJobId;
    mapping(uint256 => Job) public jobs;

    event JobCreated(uint256 indexed jobId, address indexed client, address indexed agent, uint256 amount);
    event JobReleased(uint256 indexed jobId);
    event JobDisputed(uint256 indexed jobId, address disputedBy);
    event JobResolved(uint256 indexed jobId, uint256 toAgent, uint256 toClient, uint256 toTreasury);
    event JobRefunded(uint256 indexed jobId);

    modifier onlyTreasury() {
        require(msg.sender == treasury, "Only treasury");
        _;
    }

    constructor(address _usdc, address _treasury) {
        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    /**
     * @notice Client creates a job, locking USDC in escrow.
     *         Client must approve this contract for `amount` USDC first.
     */
    function createJob(address agent, uint256 amount) external returns (uint256 jobId) {
        require(agent != address(0), "Invalid agent");
        require(amount > 0, "Amount must be > 0");

        jobId = nextJobId++;
        jobs[jobId] = Job({
            client: msg.sender,
            agent: agent,
            amount: amount,
            status: JobStatus.Active
        });

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit JobCreated(jobId, msg.sender, agent, amount);
    }

    /**
     * @notice Client releases funds to the agent after work is done.
     */
    function releaseJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(msg.sender == job.client, "Only client");
        require(job.status == JobStatus.Active, "Not active");

        job.status = JobStatus.Released;
        usdc.safeTransfer(job.agent, job.amount);
        emit JobReleased(jobId);
    }

    /**
     * @notice Either client or agent can raise a dispute.
     */
    function disputeJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(msg.sender == job.client || msg.sender == job.agent, "Not a party");
        require(job.status == JobStatus.Active, "Not active");

        job.status = JobStatus.Disputed;
        emit JobDisputed(jobId, msg.sender);
    }

    /**
     * @notice Treasury resolves a dispute by splitting funds.
     * @param toAgent   Amount to send to the agent
     * @param toClient  Amount to refund to the client
     * @param toTreasuryAmt Amount kept by treasury as mediation fee
     */
    function resolveDispute(
        uint256 jobId,
        uint256 toAgent,
        uint256 toClient,
        uint256 toTreasuryAmt
    ) external onlyTreasury {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Disputed, "Not disputed");
        require(toAgent + toClient + toTreasuryAmt == job.amount, "Split must equal total");

        job.status = JobStatus.Resolved;

        if (toAgent > 0) usdc.safeTransfer(job.agent, toAgent);
        if (toClient > 0) usdc.safeTransfer(job.client, toClient);
        if (toTreasuryAmt > 0) usdc.safeTransfer(treasury, toTreasuryAmt);

        emit JobResolved(jobId, toAgent, toClient, toTreasuryAmt);
    }

    /**
     * @notice Treasury can refund the full amount to the client (e.g. agent never delivered).
     */
    function refundJob(uint256 jobId) external onlyTreasury {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Active || job.status == JobStatus.Disputed, "Cannot refund");

        job.status = JobStatus.Refunded;
        usdc.safeTransfer(job.client, job.amount);
        emit JobRefunded(jobId);
    }
}
