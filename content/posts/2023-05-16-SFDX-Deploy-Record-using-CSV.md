---
title: SFDX Deploy Record using CSV
date: 2023-05-16T01:25:00-04:00
author: Yoonsoo Park
description: "SFDX Deploy Record using CSV"
categories:
  - Salesforce
tags:
  - sfdx
---

## Steps to Deploy Records using CSV
Follow these steps to deploy records from a `CSV` file using `SFDX`:

1. Prepare the CSV file: Ensure that your CSV file is properly formatted and contains the necessary data fields required by the target Salesforce object. Each row in the CSV represents a record, and the columns represent field values. Make sure the column headers match the field API names in Salesforce.

2. Create a Mapping File: To map the column headers in your CSV file to the corresponding Salesforce fields, create a mapping file in JSON format. This file defines the mapping between the CSV column headers and the Salesforce object fields.

### Example mapping.json:

```json
{
    "FirstName": "FirstName__c",
    "LastName": "LastName__c",
    "Email": "Email__c"
}
```
In this example, the CSV column header `"FirstName"` maps to the Salesforce custom field `"FirstName__c"`, `"LastName"` maps to `"LastName__c"`, and so on.

3. Authenticate with Salesforce: Open your terminal or command prompt and authenticate with your Salesforce org using the Salesforce CLI. Run the following command and follow the prompts:

```bash
sfdx force:auth:web:login
```
4. Navigate to your DX project: Change to the directory where your Salesforce DX project is located using the cd command in your terminal or command prompt.

5. Deploy the records: Use the `sfdx force:data:bulk:upsert` command to initiate the record deployment process. Provide the necessary options and arguments:

```bash
sfdx force:data:bulk:upsert -s ObjectName__c -f path/to/csv/file.csv -i ExternalIdField__c -m path/to/mapping.json
```
`-s`: The Salesforce object name where the records will be inserted or updated.
`-f`: The path to the CSV file containing the records.
`-i`: The external ID field used to identify existing records for updates. This field must be unique and match a column in the CSV.
`-m`: The path to the mapping file that defines the field mappings.
Replace `ObjectName__c`, `path/to/csv/file.csv`, `ExternalIdField__c`, and `path/to/mapping.json` with the appropriate values for your deployment.

6. Monitor the deployment: Once the deployment process begins, you can monitor the progress in your terminal or command prompt. SFDX will display information about the number of records processed, successes, failures, and any error messages encountered during the deployment.

7. At the last, verify the results: After the deployment completes, you can verify the results by checking your Salesforce org. Ensure that the records have been inserted or updated as expected.


Cheers! 🍺
