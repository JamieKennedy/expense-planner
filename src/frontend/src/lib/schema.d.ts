// Generated from the API OpenAPI document. Do not edit.
export interface paths {
    "/api/auth/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["SessionResponse"];
                        "application/json": components["schemas"]["SessionResponse"];
                        "text/json": components["schemas"]["SessionResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["LoginRequest"];
                    "text/json": components["schemas"]["LoginRequest"];
                    "application/*+json": components["schemas"]["LoginRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["PasswordLoginResult"];
                        "application/json": components["schemas"]["PasswordLoginResult"];
                        "text/json": components["schemas"]["PasswordLoginResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/mfa": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["MfaRequest"];
                    "text/json": components["schemas"]["MfaRequest"];
                    "application/*+json": components["schemas"]["MfaRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/invitations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["InvitationRequest"];
                    "text/json": components["schemas"]["InvitationRequest"];
                    "application/*+json": components["schemas"]["InvitationRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["InvitationResult"];
                        "application/json": components["schemas"]["InvitationResult"];
                        "text/json": components["schemas"]["InvitationResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/setup/prepare": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SetupCodeRequest"];
                    "text/json": components["schemas"]["SetupCodeRequest"];
                    "application/*+json": components["schemas"]["SetupCodeRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["MfaSetupResult"];
                        "application/json": components["schemas"]["MfaSetupResult"];
                        "text/json": components["schemas"]["MfaSetupResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/setup/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CompleteSetupRequest"];
                    "text/json": components["schemas"]["CompleteSetupRequest"];
                    "application/*+json": components["schemas"]["CompleteSetupRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["SetupCompletionResponse"];
                        "application/json": components["schemas"]["SetupCompletionResponse"];
                        "text/json": components["schemas"]["SetupCompletionResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/expenses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    month?: string;
                    accountIds?: string[];
                    tagIds?: string[];
                    contributorIds?: string[];
                    search?: string;
                    sort?: string;
                    descending?: boolean;
                    page?: number | string;
                    pageSize?: number | string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["PagedResultOfExpenseDto"];
                        "application/json": components["schemas"]["PagedResultOfExpenseDto"];
                        "text/json": components["schemas"]["PagedResultOfExpenseDto"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SaveExpenseRequest"];
                    "text/json": components["schemas"]["SaveExpenseRequest"];
                    "application/*+json": components["schemas"]["SaveExpenseRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["ExpenseDto"];
                        "application/json": components["schemas"]["ExpenseDto"];
                        "text/json": components["schemas"]["ExpenseDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/expenses/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SaveExpenseRequest"];
                    "text/json": components["schemas"]["SaveExpenseRequest"];
                    "application/*+json": components["schemas"]["SaveExpenseRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["ExpenseDto"];
                        "application/json": components["schemas"]["ExpenseDto"];
                        "text/json": components["schemas"]["ExpenseDto"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/income-items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    month?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["IncomeItemDto"][];
                        "application/json": components["schemas"]["IncomeItemDto"][];
                        "text/json": components["schemas"]["IncomeItemDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SaveIncomeItemRequest"];
                    "text/json": components["schemas"]["SaveIncomeItemRequest"];
                    "application/*+json": components["schemas"]["SaveIncomeItemRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["IncomeItemDto"];
                        "application/json": components["schemas"]["IncomeItemDto"];
                        "text/json": components["schemas"]["IncomeItemDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/income-items/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SaveIncomeItemRequest"];
                    "text/json": components["schemas"]["SaveIncomeItemRequest"];
                    "application/*+json": components["schemas"]["SaveIncomeItemRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["IncomeItemDto"];
                        "application/json": components["schemas"]["IncomeItemDto"];
                        "text/json": components["schemas"]["IncomeItemDto"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/budget-template": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["BudgetTemplateDto"];
                        "application/json": components["schemas"]["BudgetTemplateDto"];
                        "text/json": components["schemas"]["BudgetTemplateDto"];
                    };
                };
            };
        };
        put: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ReplaceBudgetRequest"];
                    "text/json": components["schemas"]["ReplaceBudgetRequest"];
                    "application/*+json": components["schemas"]["ReplaceBudgetRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["BudgetTemplateDto"];
                        "application/json": components["schemas"]["BudgetTemplateDto"];
                        "text/json": components["schemas"]["BudgetTemplateDto"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/reference-data": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    includeArchived?: boolean;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["ReferenceDataSnapshot"];
                        "application/json": components["schemas"]["ReferenceDataSnapshot"];
                        "text/json": components["schemas"]["ReferenceDataSnapshot"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/accounts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SaveNameRequest"];
                    "text/json": components["schemas"]["SaveNameRequest"];
                    "application/*+json": components["schemas"]["SaveNameRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["ReferenceItemDto"];
                        "application/json": components["schemas"]["ReferenceItemDto"];
                        "text/json": components["schemas"]["ReferenceItemDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/accounts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SaveNameRequest"];
                    "text/json": components["schemas"]["SaveNameRequest"];
                    "application/*+json": components["schemas"]["SaveNameRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["ReferenceItemDto"];
                        "application/json": components["schemas"]["ReferenceItemDto"];
                        "text/json": components["schemas"]["ReferenceItemDto"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/contributors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SaveNameRequest"];
                    "text/json": components["schemas"]["SaveNameRequest"];
                    "application/*+json": components["schemas"]["SaveNameRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["ReferenceItemDto"];
                        "application/json": components["schemas"]["ReferenceItemDto"];
                        "text/json": components["schemas"]["ReferenceItemDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/contributors/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SaveNameRequest"];
                    "text/json": components["schemas"]["SaveNameRequest"];
                    "application/*+json": components["schemas"]["SaveNameRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["ReferenceItemDto"];
                        "application/json": components["schemas"]["ReferenceItemDto"];
                        "text/json": components["schemas"]["ReferenceItemDto"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SaveTagRequest"];
                    "text/json": components["schemas"]["SaveTagRequest"];
                    "application/*+json": components["schemas"]["SaveTagRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["ReferenceItemDto"];
                        "application/json": components["schemas"]["ReferenceItemDto"];
                        "text/json": components["schemas"]["ReferenceItemDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/tags/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["SaveTagRequest"];
                    "text/json": components["schemas"]["SaveTagRequest"];
                    "application/*+json": components["schemas"]["SaveTagRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["ReferenceItemDto"];
                        "application/json": components["schemas"]["ReferenceItemDto"];
                        "text/json": components["schemas"]["ReferenceItemDto"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/reports/monthly-overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    month?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/plain": components["schemas"]["MonthlyOverviewDto"];
                        "application/json": components["schemas"]["MonthlyOverviewDto"];
                        "text/json": components["schemas"]["MonthlyOverviewDto"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        BudgetLineDto: {
            /** Format: uuid */
            id: string;
            name: string;
            /** Format: int64 */
            allowancePence: number | string;
            /** Format: uuid */
            tagId: string;
            contributorShares: components["schemas"]["ContributorShareDto"][];
        };
        BudgetLineOverviewDto: {
            /** Format: uuid */
            id: string;
            name: string;
            /** Format: uuid */
            tagId: string;
            tagName: string;
            /** Format: int64 */
            allowancePence: number | string;
            /** Format: int64 */
            projectedExpensesPence: number | string;
            /** Format: int64 */
            remainingPence: number | string;
        };
        BudgetTemplateDto: {
            /** Format: uuid */
            id: string;
            lines: components["schemas"]["BudgetLineDto"][];
        };
        CompleteSetupRequest: {
            code: string;
            password: string;
            totpCode: string;
        };
        ContributorShareDto: {
            /** Format: uuid */
            contributorId: string;
            /** Format: int32 */
            basisPoints: number | string;
            /** Format: int64 */
            allocatedPence?: null | number | string;
        };
        ExpenseDto: {
            /** Format: uuid */
            id: string;
            name: string;
            /** Format: int64 */
            amountPence: number | string;
            /** Format: uuid */
            accountId: string;
            accountName: string;
            /** Format: int32 */
            dayOfMonth: number | string;
            /** Format: date */
            dueDate: string;
            moveToNextWorkingDay: boolean;
            tagIds: string[];
            contributorShares: components["schemas"]["ContributorShareDto"][];
        };
        IncomeItemDto: {
            /** Format: uuid */
            id: string;
            name: string;
            /** Format: int64 */
            amountPence: number | string;
            /** Format: uuid */
            accountId: string;
            accountName: string;
            /** Format: int32 */
            dayOfMonth: number | string;
            /** Format: date */
            dueDate: string;
            moveToNextWorkingDay: boolean;
        };
        InvitationRequest: {
            email: string;
        };
        InvitationResult: {
            email: string;
            code: string;
            /** Format: date-time */
            expiresAt: string;
        };
        LoginRequest: {
            email: string;
            password: string;
        };
        MfaRequest: {
            challengeId: string;
            code: string;
        };
        MfaSetupResult: {
            email: string;
            sharedKey: string;
            authenticatorUri: string;
        };
        MonthlyOverviewDto: {
            month: string;
            /** Format: int64 */
            projectedIncomePence: number | string;
            /** Format: int64 */
            projectedExpensesPence: number | string;
            /** Format: int64 */
            projectedNetPence: number | string;
            contributorCosts: components["schemas"]["NamedAmountDto"][];
            tagCosts: components["schemas"]["NamedAmountDto"][];
            budgetLines: components["schemas"]["BudgetLineOverviewDto"][];
            budgetContributions: components["schemas"]["NamedAmountDto"][];
        };
        NamedAmountDto: {
            /** Format: uuid */
            id: string;
            name: string;
            /** Format: int64 */
            amountPence: number | string;
        };
        PagedResultOfExpenseDto: {
            items: components["schemas"]["ExpenseDto"][];
            /** Format: int32 */
            page: number | string;
            /** Format: int32 */
            pageSize: number | string;
            /** Format: int32 */
            totalCount: number | string;
        };
        PasswordLoginResult: {
            requiresMfa: boolean;
            challengeId: string;
        };
        ReferenceDataSnapshot: {
            accounts: components["schemas"]["ReferenceItemDto"][];
            contributors: components["schemas"]["ReferenceItemDto"][];
            tags: components["schemas"]["ReferenceItemDto"][];
        };
        ReferenceItemDto: {
            /** Format: uuid */
            id: string;
            name: string;
            isArchived: boolean;
            colour?: null | string;
        };
        ReplaceBudgetRequest: {
            lines: components["schemas"]["SaveBudgetLineRequest"][];
        };
        SaveBudgetLineRequest: {
            name: string;
            /** Format: int64 */
            allowancePence: number | string;
            /** Format: uuid */
            tagId: string;
            contributorShares: components["schemas"]["ContributorShareDto"][];
        };
        SaveExpenseRequest: {
            name: string;
            /** Format: int64 */
            amountPence: number | string;
            /** Format: uuid */
            accountId: string;
            /** Format: int32 */
            dayOfMonth: number | string;
            moveToNextWorkingDay: boolean;
            tagIds: string[];
            contributorShares: components["schemas"]["ContributorShareDto"][];
        };
        SaveIncomeItemRequest: {
            name: string;
            /** Format: int64 */
            amountPence: number | string;
            /** Format: uuid */
            accountId: string;
            /** Format: int32 */
            dayOfMonth: number | string;
            moveToNextWorkingDay: boolean;
        };
        SaveNameRequest: {
            name: string;
        };
        SaveTagRequest: {
            name: string;
            colour: string;
        };
        SessionResponse: {
            /** Format: uuid */
            userId: string;
            /** Format: uuid */
            plannerId: string;
            email: string;
        };
        SetupCodeRequest: {
            code: string;
        };
        SetupCompletionResponse: {
            email: string;
            recoveryCodes: string[];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
