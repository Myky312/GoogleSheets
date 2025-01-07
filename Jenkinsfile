pipeline {
    agent { label 'sheets' }

    tools {
        nodejs 'NodeJS'
    }

    environment {
        PATH_TO_DEPLOY = credentials('dir-google-sheet')
        GOOGLE_SHEET_PORT = credentials('google-sheet-port')
        IMAGE_NAME = 'google_sheet'
    }

    stages {
        stage('Copy .env File') {
            steps {
                script {
                    sh 'cp ${PATH_TO_DEPLOY}/.env .'
                }
            }
        }

        stage('Clean Up') {
            steps {
                script {
                    sh "docker stop ${IMAGE_NAME} || true"
                    sh "docker rm ${IMAGE_NAME} || true"
                    sh "docker rmi ${IMAGE_NAME} || true"
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    sh 'whoami'
                    sh 'docker build -t ${IMAGE_NAME} .'
                }
            }
        }

        stage('Run Docker Container') {
            steps {
                script {
                    sh """
                        docker run -d \
                        --name ${IMAGE_NAME} \
                        --env-file .env \
                        -p ${GOOGLE_SHEET_PORT}:${GOOGLE_SHEET_PORT} \
                        ${IMAGE_NAME}
                    """
                }
            }
        }
    }
}
