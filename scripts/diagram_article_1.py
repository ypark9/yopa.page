from diagrams import Diagram, Cluster, Edge
from diagrams.aws.general import User
from diagrams.aws.compute import Fargate
from diagrams.aws.storage import S3
from diagrams.aws.database import RDS
from diagrams.aws.ml import Bedrock
from diagrams.onprem.client import User as Client

with Diagram(
    "AgentCore Architecture",
    show=False,
    filename="static/images/aws/AgentCoreArchitecture",
    direction="TB",
):
    user = Client("User")

    with Cluster("AgentCore Runtime"):
        supervisor = Fargate("Supervisor Agent")

        with Cluster("Workers"):
            retrieval = Fargate("Retrieval Agent")
            compliance = Fargate("Compliance Agent")

        session_managers = [Fargate("Session Manager"), Fargate("Session Manager")]

        supervisor >> Edge(label="Delegates") >> retrieval
        supervisor >> Edge(label="Delegates") >> compliance

        retrieval >> session_managers[0]
        compliance >> session_managers[1]

    with Cluster("External Resources"):
        db = RDS("Internal DB")
        bank = S3("Financial Data")  # Representation
        bedrock = Bedrock("Foundation Model")

        retrieval >> db
        retrieval >> bank
        supervisor >> bedrock

    with Cluster("AgentCore Memory"):
        stm = S3("Short Term Memory")
        ltm = S3("Long Term Memory")

        stm >> Edge(label="Async Extract") >> ltm

        session_managers[0] >> stm
        session_managers[1] >> stm

    user >> supervisor
